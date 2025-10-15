import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/firebaseConfig';

// Define the props for the component
interface AIAssistantTestSuiteProps {
  onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; message?: string }>;
}

const processCommand = httpsCallable(functions, 'processCommand');

// --- TEST CASES ---

const countDataTestCases = [
  // Simple Counts
  { command: "how many contacts do i have?", expectedIntent: "COUNT_DATA", expectedTarget: "contacts" },
  { command: "count my books", expectedIntent: "COUNT_DATA", expectedTarget: "books" },
  { command: "how many events are scheduled?", expectedIntent: "COUNT_DATA", expectedTarget: "events" },
  // Filtered Counts
  { command: "how many contacts are in AL?", expectedIntent: "COUNT_DATA", expectedTarget: "contacts", expectedFilters: { state: "AL" } },
  { command: "count clients", expectedIntent: "COUNT_DATA", expectedTarget: "contacts", expectedFilters: { category: "Client" } },
  { command: "how many books are out of stock?", expectedIntent: "COUNT_DATA", expectedTarget: "books", expectedFilters: { stock: 0 } },
  { command: "count the books by Harper Lee", expectedIntent: "COUNT_DATA", expectedTarget: "books", expectedFilters: { author: "Harper Lee" } },
  { command: "how many events are at the Main Store?", expectedIntent: "COUNT_DATA", expectedTarget: "events", expectedFilters: { location: "Main Store" } },
  { command: "how many poetry events?", expectedIntent: "COUNT_DATA", expectedTarget: "events", expectedFilters: { name: "Poetry" } },
  { command: "count books over $20", expectedIntent: "COUNT_DATA", expectedTarget: "books", expectedFilters: { priceFilter: ">20" } },
];

const searchTestCases = [
    { command: "find contact John Smith", expectedIntent: "FIND_CONTACT" },
    { command: "look up jane.doe@example.com", expectedIntent: "FIND_CONTACT" },
    { command: "search for the book 'To Kill a Mockingbird'", expectedIntent: "FIND_BOOK" },
    { command: "find book with isbn 9780399501487", expectedIntent: "FIND_BOOK" },
    { command: "find event 'Poetry Slam'", expectedIntent: "FIND_EVENT" },
    { command: "show me the details for the Holiday Market", expectedIntent: "FIND_EVENT" },
    { command: "who wrote '1984'?", expectedIntent: "FIND_BOOK" },
    { command: "find transactions for Jane Doe", expectedIntent: "FIND_TRANSACTION" },
    { command: "show me sales from yesterday", expectedIntent: "FIND_TRANSACTION" },
    { command: "what did John Smith buy?", expectedIntent: "FIND_TRANSACTION" },
];

const addTestCases = [
    { command: "add contact Luke Skywalker", expectedIntent: "ADD_CONTACT" },
    { command: "new book 'Dune' by Frank Herbert", expectedIntent: "ADD_BOOK" },
    { command: "create event 'Sci-Fi Convention' on 2025-12-01", expectedIntent: "ADD_EVENT" },
    { command: "add a new vendor: Stark Industries", expectedIntent: "ADD_CONTACT" },
    { command: "add attendee Princess Leia to Sci-Fi Convention", expectedIntent: "ADD_ATTENDEE" },
];

const deleteTestCases = [
    { command: "delete contact Luke Skywalker", expectedIntent: "DELETE_CONTACT" },
    { command: "remove book 'Dune'", expectedIntent: "DELETE_BOOK" },
    { command: "cancel event 'Sci-Fi Convention'", expectedIntent: "DELETE_EVENT" },
    { command: "remove attendee Princess Leia from Sci-Fi Convention", expectedIntent: "REMOVE_ATTENDEE" },
    { command: "delete the last transaction for John Smith", expectedIntent: "DELETE_TRANSACTION" },
];

const editTestCases = [
    { command: "update contact Luke Skywalker's email to luke@rebellion.com", expectedIntent: "UPDATE_CONTACT" },
    { command: "change the stock of 'Dune' to 50", expectedIntent: "UPDATE_BOOK" },
    { command: "move the 'Sci-Fi Convention' to the 'Death Star Hangar'", expectedIntent: "UPDATE_EVENT" },
    { command: "update Jane Doe's phone to 555-1234", expectedIntent: "UPDATE_CONTACT" },
    { command: "change the price of '1984' to 19.84", expectedIntent: "UPDATE_BOOK" },
];

const metricsTestCases = [
    { command: "who are my top 3 customers?", expectedIntent: "METRICS_DATA" },
    { command: "what are the top 5 best selling books?", expectedIntent: "METRICS_DATA" },
    { command: "show me my lowest stock books", expectedIntent: "METRICS_DATA" },
];


const AIAssistantTestSuite: React.FC<AIAssistantTestSuiteProps> = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async (testCases: any[], testType: string) => {
    setIsRunning(true);
    const results = [];
    for (const test of testCases) {
      try {
        const response = await processCommand({ command: test.command });
        const resultData = response.data as any;
        let pass = resultData.intent === test.expectedIntent;
        
        if (test.expectedTarget && resultData.data?.countRequest?.target) {
          pass = pass && resultData.data.countRequest.target.includes(test.expectedTarget);
        }

        if (test.expectedFilters) {
          const actualFilters = resultData.data?.countRequest?.filters;
          pass = pass && JSON.stringify(actualFilters) === JSON.stringify(test.expectedFilters);
        }

        results.push({ ...test, pass, actual: resultData });
      } catch (error) {
        results.push({ ...test, pass: false, actual: `Error: ${(error as Error).message}` });
      }
    }
    setTestResults(prev => [...prev, { type: testType, results }]);
    setIsRunning(false);
  };
  
  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden p-6 my-4">
      <h3 className="text-xl font-bold mb-4">AI Assistant Test Suite</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => runTests(countDataTestCases, "Count Data")}
          className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-400"
          disabled={isRunning}
        >
          Run Count Tests ({countDataTestCases.length})
        </button>
        <button
          onClick={() => runTests(searchTestCases, "Search")}
          className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 disabled:bg-gray-400"
          disabled={isRunning}
        >
          Run Search Tests ({searchTestCases.length})
        </button>
        <button
          onClick={() => runTests(addTestCases, "Add")}
          className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 disabled:bg-gray-400"
          disabled={isRunning}
        >
          Run Add Tests ({addTestCases.length})
        </button>
        <button
          onClick={() => runTests(deleteTestCases, "Delete")}
          className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-gray-400"
          disabled={isRunning}
        >
          Run Delete Tests ({deleteTestCases.length})
        </button>
        <button
          onClick={() => runTests(editTestCases, "Edit")}
          className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:bg-gray-400"
          disabled={isRunning}
        >
          Run Edit Tests ({editTestCases.length})
        </button>
        <button
            onClick={() => runTests(metricsTestCases, "Metrics")}
            className="px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 disabled:bg-gray-400"
            disabled={isRunning}
        >
            Run Metrics Tests ({metricsTestCases.length})
        </button>
        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600"
          disabled={isRunning}
        >
          Clear Results
        </button>
      </div>

      {isRunning && <p className="text-center text-gray-600">Tests in progress...</p>}
      
      {testResults.length > 0 && (
        <div className="mt-4 max-h-96 overflow-y-auto">
          {testResults.map((suite, index) => (
            <div key={index} className="mb-4">
              <h4 className="text-lg font-semibold mb-2">{suite.type} Results</h4>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Command</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected Intent</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {suite.results.map((result: any, i: number) => (
                    <tr key={i} className={result.pass ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="px-4 py-2 text-sm text-gray-700">"{result.command}"</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{result.expectedIntent}</td>
                      <td className="px-4 py-2 text-sm font-semibold">{result.pass ? '✅ Pass' : '❌ Fail'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <pre className="whitespace-pre-wrap text-xs">
                          {JSON.stringify(result.actual, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIAssistantTestSuite;