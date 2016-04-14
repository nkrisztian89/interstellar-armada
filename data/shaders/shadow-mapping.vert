#version 100

#define DEPTH_TEXTURES 0

precision mediump float;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;

#if !DEPTH_TEXTURES
varying float v_depth;
#endif

void main() {
    gl_Position = u_projMatrix * u_lightMatrix * u_modelMatrix * vec4(a_position, 1.0);
    #if !DEPTH_TEXTURES
    v_depth = -gl_Position.z * 0.5 + 0.5;
    #endif
}