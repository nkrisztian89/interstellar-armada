#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights-full-vert.glsl"
#include "mesh/variables/point-spot-lights-vert.glsl"

void main() {
#include "mesh/vert/model-full.glsl"
#include "mesh/vert/point-spot-lights.glsl"
#include "mesh/vert/camera.glsl"
}
