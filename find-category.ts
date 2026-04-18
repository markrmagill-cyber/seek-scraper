import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

export const findCategory = async (jobTitle: string, classification: string): Promise<string> => {
  const searchTerms = [...jobTitle.split(/[\s\/&,-]+/), ...classification.split(/[\s\/&,()+]+/)]
    .filter(w => w.length > 3)
    .map(w => w.toLowerCase());

  for (const term of searchTerms) {
    const match = await mongoose.connection.collection('categories').findOne({
      category: { $regex: `^${term}`, $options: 'i' }
    });
    if (match) return match.category;
  }

  // Broader search
  for (const term of searchTerms.slice(0, 3)) {
    const match = await mongoose.connection.collection('categories').findOne({
      category: { $regex: term, $options: 'i' }
    });
    if (match) return match.category;
  }

  return 'Software Developer';
};
