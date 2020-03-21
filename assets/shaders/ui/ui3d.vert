#version 100

precision mediump float;

#include "ui/scaleMode-variables.glsl"

uniform mat4 u_viewProjMatrix;

uniform vec3 u_position;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

varying mediump vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;

    gl_Position = u_viewProjMatrix * vec4(u_position, 1.0);
#include "ui/scaleMode.glsl"
    gl_Position.xy += (a_position.xy * size * gl_Position.w);
}

