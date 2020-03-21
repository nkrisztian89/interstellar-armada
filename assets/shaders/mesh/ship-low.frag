#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights.glsl"

#include "mesh/variables/model-diff-frag.glsl"
#include "mesh/variables/model-lum-tex-frag.glsl"

void main() {
#include "mesh/frag/prep-diff.glsl"
#include "mesh/frag/luminosity-textured.glsl"
#include "mesh/frag/dir-lights-diff.glsl"
#include "mesh/frag/alpha.glsl"
}
