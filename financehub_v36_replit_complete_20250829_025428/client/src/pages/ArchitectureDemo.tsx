import { FeatureStoreDemo } from '@/components/v2/FeatureStoreDemo';

export default function ArchitectureDemo() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New Architecture Demo</h1>
        <p className="text-gray-600 mt-2">
          Testing the Bronze → Silver → Gold data model with precomputed features and unified API contracts
        </p>
      </div>
      
      <FeatureStoreDemo />
    </div>
  );
}