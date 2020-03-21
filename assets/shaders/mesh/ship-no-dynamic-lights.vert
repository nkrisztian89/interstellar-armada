#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/shadow-mapping-full-vert.glsl"

void main() {
#include "mesh/vert/shadow-mapping-full.glsl"
#include "mesh/vert/camera.glsl"
}
