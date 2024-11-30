#version 100

#include "billboard/billboard-vars-instanced.glsl"

void main() {
#include "billboard/billboard-base-instanced.glsl"
	float parallelism = abs(dot(normalize(eyeToModel), i_direction.xyz));
#include "billboard/billboard-fade-parallel-opacity.glsl"
    v_opacity = i_direction.w * factor;
}
