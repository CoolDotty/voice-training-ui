#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

#include "melder.h"
#include "melder_console.h"
#include "MelderThread.h"
#include "Formant.h"
#include "Harmonicity.h"
#include "Intensity.h"
#include "Pitch.h"
#include "Sampled.h"
#include "Sound.h"
#include "Sound_and_Spectrum.h"
#include "Sound_to_Formant.h"
#include "Sound_to_Harmonicity.h"
#include "Sound_to_Intensity.h"
#include "Sound_to_Pitch.h"
#include "Sound_to_PointProcess.h"
#include "Spectrum.h"
#include "VoiceAnalysis.h"

namespace {

constexpr double kMinVowelF1Hz = 250.0;
constexpr double kMaxVowelF1Hz = 1000.0;
constexpr double kMinReliableF3Hz = 1800.0;
constexpr double kMaxReliableF3Hz = 3400.0;
constexpr double kMinF3F2GapHz = 250.0;
constexpr double kMaxF2FrameJumpHz = 150.0;
constexpr double kMaxF3FrameJumpHz = 250.0;

void initializePraatRuntime() {
  static bool initialized = false;
  if (initialized) {
    return;
  }

  MelderConsole_init();
  Melder_init();
  MelderThread_debugMultithreading(false, 1, 1, false);
  initialized = true;
}

void writeJsonNumber(std::ostringstream& out, double value) {
  if (std::isfinite(value)) {
    out << value;
  } else {
    out << "null";
  }
}

double bestFrequencyForFrame(Pitch pitch, integer frameIndex) {
  if (frameIndex < 1 || frameIndex > pitch->nx) {
    return 0.0;
  }

  const Pitch_Frame frame = &pitch->frames[frameIndex];
  if (frame->nCandidates < 1) {
    return 0.0;
  }

  const double frequency = frame->candidates[1].frequency;
  return Pitch_util_frequencyIsVoiced(frequency, pitch->ceiling) ? frequency : 0.0;
}

double median(std::vector<double> values) {
  values.erase(
      std::remove_if(values.begin(), values.end(), [](double value) { return !std::isfinite(value); }),
      values.end());
  if (values.empty()) {
    return std::numeric_limits<double>::quiet_NaN();
  }
  std::sort(values.begin(), values.end());
  const size_t mid = values.size() / 2;
  if (values.size() % 2 == 1) {
    return values[mid];
  }
  return 0.5 * (values[mid - 1] + values[mid]);
}

double pstdev(const std::vector<double>& values) {
  if (values.empty()) {
    return std::numeric_limits<double>::infinity();
  }
  const double mean = std::accumulate(values.begin(), values.end(), 0.0) / values.size();
  double sumSquares = 0.0;
  for (double value : values) {
    const double delta = value - mean;
    sumSquares += delta * delta;
  }
  return std::sqrt(sumSquares / values.size());
}

std::vector<double> finiteChannelValues(Vector vector, integer channel = 1) {
  std::vector<double> values;
  if (!vector || channel < 1 || channel > vector->ny) {
    return values;
  }
  values.reserve(static_cast<size_t>(vector->nx));
  for (integer i = 1; i <= vector->nx; ++i) {
    const double value = vector->z[channel][i];
    if (std::isfinite(value)) {
      values.push_back(value);
    }
  }
  return values;
}

double nearestIntensity(Intensity intensity, double time) {
  if (!intensity || intensity->nx < 1) {
    return std::numeric_limits<double>::quiet_NaN();
  }
  integer index = static_cast<integer>(std::llround((time - intensity->x1) / intensity->dx)) + 1;
  index = std::max<integer>(1, std::min<integer>(intensity->nx, index));
  return intensity->z[1][index];
}

struct FormantSummary {
  double f1 = std::numeric_limits<double>::quiet_NaN();
  double f2 = std::numeric_limits<double>::quiet_NaN();
  double f3 = std::numeric_limits<double>::quiet_NaN();
};

std::vector<double> voicedTimes(Pitch pitch) {
  std::vector<double> times;
  if (!pitch) {
    return times;
  }
  for (integer iframe = 1; iframe <= pitch->nx; ++iframe) {
    if (bestFrequencyForFrame(pitch, iframe) > 0.0) {
      times.push_back(pitch->x1 + (iframe - 1) * pitch->dx);
    }
  }
  return times;
}

void subsampleInPlace(std::vector<double>& values, size_t maxValues) {
  if (values.size() <= maxValues || maxValues == 0) {
    return;
  }
  std::vector<double> sampled;
  sampled.reserve(maxValues);
  const double step = static_cast<double>(values.size()) / static_cast<double>(maxValues);
  for (size_t i = 0; i < maxValues; ++i) {
    sampled.push_back(values[static_cast<size_t>(std::floor(i * step))]);
  }
  values.swap(sampled);
}

struct FormantRows {
  std::vector<double> f1;
  std::vector<double> f2;
  std::vector<double> f3;
};

bool reliableF3(double f2, double f3) {
  return std::isfinite(f2) && std::isfinite(f3) &&
      f3 >= kMinReliableF3Hz && f3 <= kMaxReliableF3Hz &&
      f3 - f2 >= kMinF3F2GapHz;
}

FormantRows measureVowelFormants(Sound sound, const std::vector<double>& candidateTimes, double ceiling) {
  FormantRows out;
  autoFormant formant = Sound_to_Formant_burg(sound, 0.0, 5.0, ceiling, 0.025, 50.0);
  struct Row {
    double f1;
    double f2;
    double f3;
  };
  std::vector<Row> rows;

  for (double time : candidateTimes) {
    const double f1 = Formant_getValueAtTime(formant.get(), 1, time, kFormant_unit::HERTZ);
    const double f2 = Formant_getValueAtTime(formant.get(), 2, time, kFormant_unit::HERTZ);
    const double f3 = Formant_getValueAtTime(formant.get(), 3, time, kFormant_unit::HERTZ);
    if (!std::isfinite(f1) || !std::isfinite(f2) || !std::isfinite(f3)) {
      continue;
    }
    if (f1 <= 0.0 || f2 <= 0.0 || f1 < kMinVowelF1Hz || f1 > kMaxVowelF1Hz) {
      continue;
    }
    rows.push_back({f1, f2, f3});
  }

  double previousF2 = std::numeric_limits<double>::quiet_NaN();
  double previousF3 = std::numeric_limits<double>::quiet_NaN();
  for (const Row& row : rows) {
    if (std::isfinite(previousF2) && std::abs(row.f2 - previousF2) > kMaxF2FrameJumpHz) {
      previousF2 = row.f2;
      continue;
    }
    out.f1.push_back(row.f1);
    out.f2.push_back(row.f2);

    if (reliableF3(row.f2, row.f3) &&
        (!std::isfinite(previousF3) || std::abs(row.f3 - previousF3) <= kMaxF3FrameJumpHz)) {
      out.f3.push_back(row.f3);
      previousF3 = row.f3;
    } else if (std::isfinite(row.f3)) {
      previousF3 = row.f3;
    }
    previousF2 = row.f2;
  }
  return out;
}

FormantSummary summarizeVowelFormants(Sound sound, Pitch pitch, Intensity intensity) {
  std::vector<double> candidates;
  const auto intensities = finiteChannelValues(intensity);
  if (intensities.empty()) {
    return {};
  }
  const double peak = *std::max_element(intensities.begin(), intensities.end());
  const double loudFloor = peak - 10.0;

  for (integer iframe = 1; iframe <= pitch->nx; ++iframe) {
    if (bestFrequencyForFrame(pitch, iframe) <= 0.0) {
      continue;
    }
    const double time = pitch->x1 + (iframe - 1) * pitch->dx;
    if (nearestIntensity(intensity, time) >= loudFloor) {
      candidates.push_back(time);
    }
  }
  subsampleInPlace(candidates, 300);
  if (candidates.empty()) {
    return {};
  }

  FormantRows best;
  double bestSpread = std::numeric_limits<double>::infinity();
  bool haveBest = false;
  for (double ceiling : {5500.0, 5000.0}) {
    FormantRows rows = measureVowelFormants(sound, candidates, ceiling);
    if (rows.f2.size() < 5) {
      continue;
    }
    const double spread = pstdev(rows.f2);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = std::move(rows);
      haveBest = true;
    }
  }
  if (!haveBest) {
    best = measureVowelFormants(sound, candidates, 5500.0);
  }

  return {median(best.f1), median(best.f2), median(best.f3)};
}

double iseliCorrection(double harmonicHz, double formantHz, double bandwidthHz, double sampleRate) {
  if (harmonicHz <= 0.0 || formantHz <= 0.0 || bandwidthHz <= 0.0 || sampleRate <= 0.0) {
    return 0.0;
  }
  const double r = std::exp(-M_PI * bandwidthHz / sampleRate);
  const double omega = 2.0 * M_PI * formantHz / sampleRate;
  const double omegaH = 2.0 * M_PI * harmonicHz / sampleRate;
  const double numerator = std::pow(r * r - 2.0 * r * std::cos(omega) + 1.0, 2.0);
  const double denominator =
      (r * r - 2.0 * r * std::cos(omega + omegaH) + 1.0) *
      (r * r - 2.0 * r * std::cos(omega - omegaH) + 1.0);
  if (numerator <= 0.0 || denominator <= 0.0) {
    return 0.0;
  }
  return 10.0 * std::log10(numerator / denominator);
}

double harmonicDb(Spectrum spectrum, double targetHz, double f0) {
  if (!spectrum || targetHz <= 0.0 || f0 <= 0.0) {
    return std::numeric_limits<double>::quiet_NaN();
  }
  const double half = std::max(f0 * 0.5, 20.0);
  double peak = -std::numeric_limits<double>::infinity();
  for (integer ibin = 1; ibin <= spectrum->nx; ++ibin) {
    const double hz = spectrum->x1 + (ibin - 1) * spectrum->dx;
    if (hz < targetHz - half || hz > targetHz + half) {
      continue;
    }
    const double re = spectrum->z[1][ibin];
    const double im = spectrum->z[2][ibin];
    const double power = re * re + im * im;
    if (power > 0.0 && std::isfinite(power)) {
      peak = std::max(peak, 10.0 * std::log10(power));
    }
  }
  return std::isfinite(peak) ? peak : std::numeric_limits<double>::quiet_NaN();
}

struct WeightSummary {
  double h1a3c = std::numeric_limits<double>::quiet_NaN();
  double h1a3 = std::numeric_limits<double>::quiet_NaN();
  double tilt = std::numeric_limits<double>::quiet_NaN();
};

WeightSummary summarizeWeight(Sound sound, Pitch pitch, double sampleRate, double duration) {
  std::vector<double> h1a3cValues;
  std::vector<double> h1a3Values;
  std::vector<double> times = voicedTimes(pitch);
  subsampleInPlace(times, 250);
  if (times.empty()) {
    return {};
  }

  autoFormant formant = Sound_to_Formant_burg(sound, 0.0, 5.0, 5500.0, 0.025, 50.0);
  for (double time : times) {
    const integer iframe = static_cast<integer>(std::llround((time - pitch->x1) / pitch->dx)) + 1;
    const double f0 = bestFrequencyForFrame(pitch, iframe);
    if (f0 <= 0.0) {
      continue;
    }
    const double window = std::max(0.025, 3.0 / f0);
    const double t0 = time - window / 2.0;
    const double t1 = time + window / 2.0;
    if (t0 < 0.0 || t1 > duration) {
      continue;
    }

    double formantHz[4] = {0.0, 0.0, 0.0, 0.0};
    double bandwidthHz[4] = {0.0, 0.0, 0.0, 0.0};
    bool ok = true;
    for (int n = 1; n <= 3; ++n) {
      formantHz[n] = Formant_getValueAtTime(formant.get(), n, time, kFormant_unit::HERTZ);
      bandwidthHz[n] = Formant_getBandwidthAtTime(formant.get(), n, time, kFormant_unit::HERTZ);
      if (!std::isfinite(formantHz[n]) || !std::isfinite(bandwidthHz[n]) ||
          formantHz[n] <= 0.0 || bandwidthHz[n] <= 0.0) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      continue;
    }

    autoSound part = Sound_extractPart(sound, t0, t1, kSound_windowShape::HAMMING, 1.0, false);
    autoSpectrum spectrum = Sound_to_Spectrum(part.get(), true);
    const double h1 = harmonicDb(spectrum.get(), f0, f0);
    const int k3 = std::max(1, static_cast<int>(std::llround(formantHz[3] / f0)));
    const double a3Hz = k3 * f0;
    const double a3 = harmonicDb(spectrum.get(), a3Hz, f0);
    if (!std::isfinite(h1) || !std::isfinite(a3)) {
      continue;
    }

    double h1Corrected = h1;
    double a3Corrected = a3;
    for (int n = 1; n <= 3; ++n) {
      h1Corrected -= iseliCorrection(f0, formantHz[n], bandwidthHz[n], sampleRate);
      a3Corrected -= iseliCorrection(a3Hz, formantHz[n], bandwidthHz[n], sampleRate);
    }
    h1a3cValues.push_back(h1Corrected - a3Corrected);
    h1a3Values.push_back(h1 - a3);
  }

  return {median(h1a3cValues), median(h1a3Values), std::numeric_limits<double>::quiet_NaN()};
}

}  // namespace

std::string analyzePcmJson(emscripten::val samplesValue, double sampleRate, double pitchFloor, double pitchCeiling) {
  initializePraatRuntime();

  const unsigned length = samplesValue["length"].as<unsigned>();
  if (length == 0 || !std::isfinite(sampleRate) || sampleRate <= 0.0) {
    return R"({"error":"Expected non-empty PCM samples and a positive sampleRate"})";
  }

  if (!std::isfinite(pitchFloor) || pitchFloor <= 0.0) {
    pitchFloor = 75.0;
  }
  if (!std::isfinite(pitchCeiling) || pitchCeiling <= pitchFloor) {
    pitchCeiling = std::min(sampleRate * 0.45, 600.0);
  }

  const double duration = static_cast<double>(length) / sampleRate;
  autoSound sound = Sound_createSimple(1, duration, sampleRate);
  const integer copyLength = std::min<integer>(static_cast<integer>(length), sound->nx);

  for (integer i = 1; i <= copyLength; ++i) {
    sound->z[1][i] = samplesValue[i - 1].as<double>();
  }

  autoPitch pitch = Sound_to_Pitch(sound.get(), 0.0, pitchFloor, pitchCeiling);
  autoIntensity intensity = Sound_to_Intensity(sound.get(), pitchFloor, 0.0, true);
  FormantSummary formants = summarizeVowelFormants(sound.get(), pitch.get(), intensity.get());

  autoHarmonicity harmonicity = Sound_to_Harmonicity_cc(sound.get(), 0.01, pitchFloor, 0.1, 1.0);
  const double hnr = Harmonicity_getMean(harmonicity.get(), 0.0, 0.0);
  autoPointProcess pointProcess = Sound_to_PointProcess_periodic_cc(sound.get(), pitchFloor, pitchCeiling);
  const double jitter = PointProcess_getJitter_local(pointProcess.get(), 0.0, 0.0, 0.0001, 0.02, 1.3);
  const double shimmer = PointProcess_Sound_getShimmer_local(
      pointProcess.get(), sound.get(), 0.0, 0.0, 0.0001, 0.02, 1.3, 1.6);
  const WeightSummary weight = summarizeWeight(sound.get(), pitch.get(), sampleRate, duration);

  const auto intensityValues = finiteChannelValues(intensity.get());
  const double minIntensity = intensityValues.empty()
      ? std::numeric_limits<double>::quiet_NaN()
      : *std::min_element(intensityValues.begin(), intensityValues.end());
  const double maxIntensity = intensityValues.empty()
      ? std::numeric_limits<double>::quiet_NaN()
      : *std::max_element(intensityValues.begin(), intensityValues.end());

  std::ostringstream out;
  out << std::setprecision(12);
  out << "{";
  out << R"("engine":"praat-wasm",)";
  out << R"("sampleRate":)";
  writeJsonNumber(out, sampleRate);
  out << ",";
  out << R"("duration":)";
  writeJsonNumber(out, duration);
  out << ",";
  out << R"("formants":{)";
  out << R"("f1":)";
  writeJsonNumber(out, formants.f1);
  out << R"(,"f2":)";
  writeJsonNumber(out, formants.f2);
  out << R"(,"f3":)";
  writeJsonNumber(out, formants.f3);
  out << R"(},)";
  out << R"("voiceQuality":{)";
  out << R"("hnr":)";
  writeJsonNumber(out, hnr);
  out << R"(,"jitter":)";
  writeJsonNumber(out, std::isfinite(jitter) ? jitter * 100.0 : std::numeric_limits<double>::quiet_NaN());
  out << R"(,"shimmer":)";
  writeJsonNumber(out, std::isfinite(shimmer) ? shimmer * 100.0 : std::numeric_limits<double>::quiet_NaN());
  out << R"(},)";
  out << R"("intensity":{)";
  out << R"("mean":)";
  writeJsonNumber(out, Intensity_getAverage(intensity.get(), 0.0, 0.0, Intensity_averaging_ENERGY));
  out << R"(,"min":)";
  writeJsonNumber(out, minIntensity);
  out << R"(,"max":)";
  writeJsonNumber(out, maxIntensity);
  out << R"(},)";
  out << R"("weight":{)";
  out << R"("h1a3c":)";
  writeJsonNumber(out, weight.h1a3c);
  out << R"(,"h1a3":)";
  writeJsonNumber(out, weight.h1a3);
  out << R"(,"tilt":)";
  writeJsonNumber(out, weight.tilt);
  out << R"(},)";
  out << R"("pitch":{)";
  out << R"("mean":)";
  writeJsonNumber(out, Pitch_getMean(pitch.get(), 0.0, 0.0, kPitch_unit::HERTZ));
  out << R"(,"median":)";
  writeJsonNumber(out, Pitch_getQuantile(pitch.get(), 0.0, 0.0, 0.5, kPitch_unit::HERTZ));
  out << R"(,"min":)";
  writeJsonNumber(out, Pitch_getMinimum(pitch.get(), 0.0, 0.0, kPitch_unit::HERTZ, false));
  out << R"(,"max":)";
  writeJsonNumber(out, Pitch_getMaximum(pitch.get(), 0.0, 0.0, kPitch_unit::HERTZ, false));
  out << R"(,"sd":)";
  writeJsonNumber(out, Pitch_getStandardDeviation(pitch.get(), 0.0, 0.0, kPitch_unit::HERTZ));
  out << R"(,"voicedFrames":)" << Pitch_countVoicedFrames(pitch.get());
  out << R"(,"frames":[)";
  for (integer iframe = 1; iframe <= pitch->nx; ++iframe) {
    if (iframe > 1) {
      out << ",";
    }
    const double time = pitch->x1 + (iframe - 1) * pitch->dx;
    out << "{";
    out << R"("time":)";
    writeJsonNumber(out, time);
    out << R"(,"frequency":)";
    writeJsonNumber(out, bestFrequencyForFrame(pitch.get(), iframe));
    out << R"(,"intensity":)";
    writeJsonNumber(out, pitch->frames[iframe].intensity);
    out << "}";
  }
  out << "]}}";

  return out.str();
}

EMSCRIPTEN_BINDINGS(voice_garden_praat) {
  emscripten::function("analyzePcmJson", &analyzePcmJson);
}
