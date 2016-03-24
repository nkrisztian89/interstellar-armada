#version 100

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base.glsl"

attribute vec2 a_texCoord;
attribute vec4 a_color;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
#include "mesh/vert/simple-position.glsl"    
    v_texCoord = a_texCoord;
    v_color = a_color;
}
