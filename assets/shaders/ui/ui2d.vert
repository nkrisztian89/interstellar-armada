#version 100

precision mediump float;

#include "ui/scaleMode-variables.glsl"

uniform vec2 u_position;
uniform mat2 u_rotationMatrix;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

varying mediump vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;
#include "ui/scaleMode.glsl"
    gl_Position = vec4(u_position + (u_rotationMatrix * a_position.xy * size), 0.0, 1.0);
}
