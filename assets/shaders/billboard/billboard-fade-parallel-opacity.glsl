	float para_factor = parallelism + 0.5;
	para_factor = clamp((para_factor * para_factor) - 0.5, 0.0, 1.0);
	float perp_factor = clamp(-30.0 * parallelism + 30.0, 0.0, 1.0);
	float has_z = abs(sign(a_position.z));
	float factor = (1.0 - has_z) * perp_factor + has_z * para_factor;
