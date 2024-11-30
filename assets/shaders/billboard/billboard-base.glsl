	vec3 eyeToModel = u_position.xyz - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel, u_direction.xyz)) * u_position.w, 0.0);
	vec4 vy = vec4(u_direction.xyz * u_position.w, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * u_position.w, 0.0);
	vec4 vw = vec4(u_position.xyz, 1.0);

	mat4 mvpMatrix = u_viewProjMatrix * mat4(vx, vy, vz, vw);

	gl_Position = mvpMatrix * vec4(a_position, 1.0);	

	v_texCoord = a_texCoord;