#version 100

#include "billboard/billboard-vars.glsl"

void main() {
#include "billboard/billboard-base.glsl"
	float parallelism = abs(dot(normalize(eyeToModel), u_direction.xyz));
#include "billboard/billboard-fade-parallel-opacity.glsl"
    v_opacity = u_direction.w * factor;
}
