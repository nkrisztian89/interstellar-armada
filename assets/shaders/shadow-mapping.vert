#version 100

#define NO_NORMALS

#define DEPTH_TEXTURES 0

#include "mesh/variables/shadow-mapping-constants.glsl"

precision mediump float;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform vec3 u_shadowMapParams;

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

    float range = u_shadowMapParams.x;
    float depthRange = u_shadowMapParams.y;
    float parallelism = u_shadowMapParams.z;

#include "lisptm.glsl"

    gl_Position = u_lightMatrix * gl_Position;
    gl_Position.y -= parallelism * range + near; 
    gl_Position.z = -gl_Position.z + parallelism * range;
    gl_Position = LiSPTM * gl_Position;
    #if !DEPTH_TEXTURES
    v_depth = -gl_Position.z * 0.5 + 0.5;
    #endif
}