#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <cmath>

class TextAnalyzer {
public:
    static std::unordered_map<std::string, int> getTermFrequencies(const std::string& text) {
        std::unordered_map<std::string, int> frequencies;
        std::string cleanedText = text;

        // Convert to lowercase and remove basic punctuation
        std::transform(cleanedText.begin(), cleanedText.end(), cleanedText.begin(), ::tolower);
        for (char& c : cleanedText) {
            if (ispunct(c)) c = ' ';
        }

        std::stringstream ss(cleanedText);
        std::string token;
        while (ss >> token) {
            frequencies[token]++;
        }

        return frequencies;
    }

    static double calculateEntropy(const std::string& text) {
        auto freqs = getTermFrequencies(text);
        double totalTokens = 0;
        for (const auto& pair : freqs) {
            totalTokens += pair.second;
        }

        if (totalTokens == 0) return 0.0;

        double entropy = 0.0;
        for (const auto& pair : freqs) {
            double p = static_cast<double>(pair.second) / totalTokens;
            entropy -= p * std::log2(p);
        }

        return entropy;
    }
};

int main() {
    std::string sampleAnswer = "The concept of photosynthesis involves converting light energy into chemical energy within the chloroplasts.";
    double entropy = TextAnalyzer::calculateEntropy(sampleAnswer);
    
    std::cout << "Lexical Entropy: " << entropy << " bits per word" << std::endl;
    return 0;
}