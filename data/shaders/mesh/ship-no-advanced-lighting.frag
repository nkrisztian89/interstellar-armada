#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights-full-frag.glsl"
#include "mesh/variables/shield-frag.glsl"
	
void main() {
#include "mesh/frag/dir-lights-full.glsl"
#include "mesh/frag/shield.glsl"
}

