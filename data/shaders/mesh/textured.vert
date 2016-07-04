#version 100

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base.glsl"
#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"

attribute mediump vec2 a_texCoord;
attribute lowp vec4 a_color;

varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

void main() {
#include "mesh/vert/simple-position.glsl"    
    v_texCoord = a_texCoord;
    v_color = a_color;
}
