#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/shadow-mapping-full-frag.glsl"
	
void main() {
#include "mesh/frag/shadow-mapping-full.glsl"
}

