#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights.glsl"

#include "mesh/variables/model-diff-frag.glsl"
#include "mesh/variables/model-lum-frag.glsl"
#include "mesh/variables/model-spec-frag.glsl"

void main() {
#include "mesh/frag/prep-diff.glsl"
#include "mesh/frag/prep-spec.glsl"
#include "mesh/frag/luminosity.glsl"
#include "mesh/frag/dir-lights.glsl"
#include "mesh/frag/alpha.glsl"
}
