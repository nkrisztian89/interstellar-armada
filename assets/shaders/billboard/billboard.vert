#version 100

#include "billboard/billboard-vars.glsl"

void main() {
#include "billboard/billboard-base.glsl"
	v_opacity = u_direction.w;
}
