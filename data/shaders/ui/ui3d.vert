#version 100

precision mediump float;

#include "ui/scaleMode-variables.glsl"

uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform vec3 u_position;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

varying mediump vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;

    gl_Position = u_projMatrix * u_cameraMatrix * vec4(u_position, 1.0);
#include "ui/scaleMode.glsl"
    gl_Position.xy += (a_position.xy * size * gl_Position.w);
}

