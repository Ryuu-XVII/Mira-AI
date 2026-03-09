import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 2000;

export const ParticleField = () => {
    const pointsRef = useRef<THREE.Points>(null);

    const particles = useRef(() => {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

            velocities[i * 3] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
        }

        return { positions, velocities };
    }).current();

    useFrame(() => {
        if (!pointsRef.current) return;

        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = particles.velocities;

        const speed = 0.02; // Constant speed, no audio reactivity

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] += velocities[i * 3] * speed;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * speed;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * speed;

            // Boundary wrapping
            if (Math.abs(positions[i * 3]) > 5) positions[i * 3] *= -1;
            if (Math.abs(positions[i * 3 + 1]) > 5) positions[i * 3 + 1] *= -1;
            if (Math.abs(positions[i * 3 + 2]) > 5) positions[i * 3 + 2] *= -1;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={PARTICLE_COUNT}
                    array={particles.positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.05}
                color="#FFC000"
                transparent
                opacity={0.6}
                sizeAttenuation
            />
        </points>
    );
};
