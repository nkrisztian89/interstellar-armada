mat4 groupTransform = u_groupTransforms[int(a_groupIndices.x)];

gl_Position = groupTransform * gl_Position;
#ifndef SHADOW_MAPPING_SHADER
vec3 normal = mat3(groupTransform) * a_normal;
#endif