import React, { useState } from 'react';
import { processNaturalLanguageCommand } from '../services/geminiService';

interface AIAssistantTestSuiteProps {
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string }>;
}

const testQueries = [
    { query: "how many contacts do i have in montgomery?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { city: "montgomery" } } },
    { query: "count the contacts in alabama", expected: { intent: "COUNT_DATA", target: "contacts", filters: { state: "alabama" } } },
    { query: "how many clients?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { category: "Client" } } },
    { query: "how many contacts in zip code 36104?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { zip: "36104" } } },
    { query: "count the books by Harper Lee", expected: { intent: "COUNT_DATA", target: "books", filters: { author: "Harper Lee" } } },
    { query: "how many fiction books?", expected: { intent: "COUNT_DATA", target: "books", filters: { genre: "fiction" } } },
    { query: "count the events at the Main Store", expected: { intent: "COUNT_DATA", target: "events", filters: { location: "Main Store" } } },
    { query: "how many events with Jane Doe?", expected: { intent: "COUNT_DATA", target: "events", filters: { author: "Jane Doe" } } },
    { query: "total number of contacts", expected: { intent: "COUNT_DATA", target: "contacts" } },
    { query: "how many books are in stock?", expected: { intent: "COUNT_DATA", target: "books" } },
    { query: "count all events", expected: { intent: "COUNT_DATA", target: "events" } },
    { query: "how many personal contacts?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { category: "Personal" } } },
    { query: "how many contacts in birmingham, al?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { city: "birmingham", state: "al" } } },
    { query: "number of contacts in the media category", expected: { intent: "COUNT_DATA", target: "contacts", filters: { category: "Media" } } },
    { query: "count books published by Penguin Random House", expected: { intent: "COUNT_DATA", target: "books", filters: { publisher: "Penguin Random House" } } },
    { query: "how many books were published in 1960?", expected: { intent: "COUNT_DATA", target: "books", filters: { publicationYear: 1960 } } },
    { query: "count events in the Upstairs Loft", expected: { intent: "COUNT_DATA", target: "events", filters: { location: "Upstairs Loft" } } },
    { query: "how many contacts are vendors?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { category: "Vendor" } } },
    { query: "total books in inventory", expected: { intent: "COUNT_DATA", target: "books" } },
    { query: "count of all scheduled events", expected: { intent: "COUNT_DATA", target: "events" } },
    { query: "how many contacts in mobile, alabama with zip 36602?", expected: { intent: "COUNT_DATA", target: "contacts", filters: { city: "mobile", state: "alabama", zip: "36602" } } },
    { query: "count books by George Orwell", expected: { intent: "COUNT_DATA", target: "books", filters: { author: "George Orwell" } } },
    { query: "how many poetry events?", expected: { intent: "COUNT_DATA", target: "events", filters: { name: "poetry" } } },
    { query: "number of contacts that are not clients", expected: { intent: "COUNT_DATA", target: "contacts", filters: { category: "not Client" } } },
    { query: "how many books are out of stock?", expected: { intent: "COUNT_DATA", target: "books", filters: { stock: 0 } } },
];

const AIAssistantTestSuite: React.FC<AIAssistantTestSuiteProps> = ({ onProcessAiCommand }) => {
    const [results, setResults] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const runTests = async () => {
        setIsRunning(true);
        const testResults = [];
        for (const test of testQueries) {
            console.log(`%c[TEST SUITE] Running test for query: "${test.query}"`, 'color: blue; font-weight: bold;');
            try {
                const response = await processNaturalLanguageCommand(test.query, true);
                console.log('[TEST SUITE] Raw response from AI:', response);

                const finalResult = await onProcessAiCommand(response.intent, response);
                console.log('[TEST SUITE] Final processed result:', finalResult);

                let pass = response.intent === test.expected.intent && response.countRequest?.target === test.expected.target;
                
                if (pass && test.expected.filters) {
                  if (!response.countRequest.filters) {
                    pass = false;
                  } else {
                    // Case-insensitive comparison of filter values
                    const expectedFilters = test.expected.filters;
                    const actualFilters = response.countRequest.filters;
                    pass = Object.keys(expectedFilters).every(key =>
                      actualFilters.hasOwnProperty(key) &&
                      String(actualFilters[key]).toLowerCase() === String(expectedFilters[key]).toLowerCase()
                    );
                  }
                }
                
                testResults.push({ ...test, pass, actual: response, finalMessage: finalResult.message });
                console.log(`%c[TEST SUITE] Test for query "${test.query}" completed. Pass: ${pass}`, `color: ${pass ? 'green' : 'red'};`);
            } catch (error) {
                console.error(`[TEST SUITE] Error running test for query: "${test.query}"`, error);
                testResults.push({ ...test, pass: false, actual: 'Error', finalMessage: 'Error during processing.' });
            }
        }
        setResults(testResults);
        setIsRunning(false);
    };

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 mt-2 mb-10">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">AI Assistant Test Suite</h3>
            <button
                onClick={runTests}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-300"
            >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </button>
            <div className="mt-4 space-y-4">
                {results.map((result, index) => (
                    <div key={index} className={`p-4 rounded-lg ${result.pass ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="font-semibold">Query: "{result.query}"</p>
                        <p>Status: <span className={`font-bold ${result.pass ? 'text-green-700' : 'text-red-700'}`}>{result.pass ? 'Pass' : 'Fail'}</span></p>
                        <p className="mt-2 font-semibold">Final Response:</p>
                        <p className="text-sm p-2 bg-gray-100 rounded">{result.finalMessage}</p>
                        <details className="text-sm mt-2">
                            <summary className="cursor-pointer">Details</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                Expected: {JSON.stringify(result.expected, null, 2)}
                            </pre>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                Actual AI Interpretation: {JSON.stringify(result.actual, null, 2)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIAssistantTestSuite;