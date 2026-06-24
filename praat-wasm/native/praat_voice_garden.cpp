#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>
#include <string>

#include "melder.h"
#include "melder_console.h"
#include "MelderThread.h"
#include "Sound.h"
#include "Sound_to_Pitch.h"
#include "Pitch.h"

namespace {

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
