#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/shadow-mapping-full-frag.glsl"
#include "mesh/variables/point-spot-lights-frag.glsl"
	
void main() {
#include "mesh/frag/shadow-mapping-full.glsl"
#include "mesh/frag/point-spot-lights-diff-spec.glsl"
}

