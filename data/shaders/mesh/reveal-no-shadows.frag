#version 100

precision mediump float;
precision mediump int;

#include "mesh/variables/dir-lights-full-frag.glsl"
#include "mesh/variables/point-spot-lights-frag.glsl"
#include "mesh/variables/reveal-frag.glsl"
	
void main() {
#include "mesh/frag/reveal-discard.glsl"

#include "mesh/frag/dir-lights-full.glsl"
#include "mesh/frag/point-spot-lights-diff.glsl"

    vec4 color = gl_FragColor;

#include "mesh/frag/reveal-transition.glsl"
}

