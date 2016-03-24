#version 100

precision mediump float;

uniform vec4 u_color;

#include "mesh/variables/reveal-frag.glsl"
	
void main() {
#include "mesh/frag/reveal-discard.glsl"

        vec4 color = u_color;

#include "mesh/frag/reveal-transition.glsl"
}
