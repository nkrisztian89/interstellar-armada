#version 100

precision mediump float;

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base-vert.glsl"
#include "mesh/variables/model-diff-vert.glsl"
#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"

void main() {
#include "mesh/vert/simple-position.glsl"
#include "mesh/vert/simple-diff.glsl"
#include "mesh/vert/model-diff.glsl"
}
