#version 100

precision mediump float;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;
attribute vec4 a_triangleIndex;

varying vec4 v_color;

void main() {
    gl_Position = u_projMatrix * u_lightMatrix * u_modelMatrix * vec4(a_position, 1.0);
    float depth = -gl_Position.z * 128.0 + 128.0;
    v_color = vec4(a_triangleIndex.xy, fract(depth), floor(depth) / 256.0);
}