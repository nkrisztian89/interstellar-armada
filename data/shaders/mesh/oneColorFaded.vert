#version 100

#define NO_NORMALS

precision mediump float;

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base-vert.glsl"
#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"
varying vec4 v_worldPos;

void main() {
#include "mesh/vert/model-base.glsl"
#include "mesh/vert/model-group-transform.glsl"
#include "mesh/vert/model-position.glsl"
v_worldPos = gl_Position;
#include "mesh/vert/camera.glsl"
}
