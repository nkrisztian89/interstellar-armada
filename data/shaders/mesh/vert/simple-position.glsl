mat4 groupTransform = u_groupTransforms[int(a_groupIndices.x)];
gl_Position = u_viewProjMatrix * u_modelMatrix * groupTransform * vec4(a_position, 1.0);

