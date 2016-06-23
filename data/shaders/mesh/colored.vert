#version 100

precision mediump float;

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base-vert.glsl"
#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"

attribute lowp vec4 a_color;

varying lowp vec4 v_color;

void main() {
#include "mesh/vert/simple-position.glsl"
    v_color = a_color;
}
