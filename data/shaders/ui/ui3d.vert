#version 100

precision mediump float;

uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform float u_aspect;

uniform vec3 u_position;
uniform vec2 u_size;

attribute vec3 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;

    gl_Position = u_projMatrix * u_cameraMatrix * vec4(u_position, 1.0);
    gl_Position.xy += (a_position.xy * vec2(u_size.x / u_aspect, u_size.y) * gl_Position.w);
}

