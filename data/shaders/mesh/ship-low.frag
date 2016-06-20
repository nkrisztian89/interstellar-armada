#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights.glsl"

#include "mesh/variables/model-diff-frag.glsl"
#include "mesh/variables/model-spec-frag.glsl"

void main() {
#include "mesh/frag/prep-diff.glsl"
#include "mesh/frag/prep-spec.glsl"
gl_FragColor.rgb = vec3(0.0, 0.0, 0.0);
#include "mesh/frag/dir-lights.glsl"
#include "mesh/frag/alpha.glsl"
}
