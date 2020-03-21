#version 100

precision mediump float;

uniform lowp vec4 u_color;

#include "mesh/variables/reveal-frag.glsl"
	
void main() {
#include "mesh/frag/reveal-discard.glsl"

        lowp vec4 color = u_color;

#include "mesh/frag/reveal-transition.glsl"
}
