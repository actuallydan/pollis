"use client";

import { DotMatrix, gameOfLifeAlgorithm, Card, Paragraph } from "monopollis";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background DotMatrix */}
      <div className="absolute inset-0 opacity-20">
        <DotMatrix
          algorithm={gameOfLifeAlgorithm}
          speed={0.5}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h1 className="text-6xl md:text-8xl font-bold mb-6">
          Pollis
        </h1>

        <Paragraph size="lg" className="mb-8 opacity-70">
          End-to-End Encrypted Messaging
        </Paragraph>

        <Paragraph className="mb-12 max-w-2xl mx-auto opacity-90">
          Secure, private communication for teams and individuals.
          <br />
          Your messages, your keys, your privacy.
        </Paragraph>

        <Paragraph size="sm" className="opacity-75">
          Desktop app coming soon. Currently in private beta.
        </Paragraph>
      </div>
    </div>
  );
}
