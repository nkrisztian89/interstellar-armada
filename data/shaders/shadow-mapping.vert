#version 100

#define SHADOW_MAPPING_SHADER

#define DEPTH_TEXTURES 0

precision mediump float;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;

#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"

#if !DEPTH_TEXTURES
varying float v_depth;
#endif

void main() {
#include "mesh/vert/model-base.glsl"
#include "mesh/vert/model-group-transform.glsl"
#include "mesh/vert/model-position.glsl"
    gl_Position = u_projMatrix * u_lightMatrix * gl_Position;
    #if !DEPTH_TEXTURES
    v_depth = -gl_Position.z * 0.5 + 0.5;
    #endif
}