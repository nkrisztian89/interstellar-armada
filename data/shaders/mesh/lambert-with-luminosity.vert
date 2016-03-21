#version 100

precision mediump float;

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base-vert.glsl"
#include "mesh/variables/model-diff-vert.glsl"
#include "mesh/variables/model-lum-vert.glsl"

void main() {
#include "mesh/vert/simple-position.glsl"
#include "mesh/vert/model-diff.glsl"
#include "mesh/vert/model-lum.glsl"
}
