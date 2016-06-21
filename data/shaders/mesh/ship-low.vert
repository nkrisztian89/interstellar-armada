#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights.glsl"

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base-vert.glsl"
#include "mesh/variables/model-diff-vert.glsl"
#include "mesh/variables/model-lum-tex-vert.glsl"

void main() {
#include "mesh/vert/model-position.glsl"
#include "mesh/vert/model-diff.glsl"
#include "mesh/vert/model-lum-tex.glsl"
#include "mesh/vert/camera.glsl"
}

