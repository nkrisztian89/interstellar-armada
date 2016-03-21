#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights-full-frag.glsl"
	
void main() {
#include "mesh/frag/dir-lights-full.glsl"
}

