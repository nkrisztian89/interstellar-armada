#version 100

precision mediump float;

#include "mesh/variables/dir-lights.glsl"

#include "mesh/variables/model-diff-frag.glsl"
#include "mesh/variables/model-lum-frag.glsl"

void main() {
#include "mesh/frag/prep-diff.glsl"
#include "mesh/frag/luminosity.glsl"
#include "mesh/frag/simple-diff.glsl"
#include "mesh/frag/alpha.glsl"
}