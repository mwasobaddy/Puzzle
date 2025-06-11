import React from "react";
import { FaCrown } from "react-icons/fa";

const UpgradeModalHome = ({ isOpen, onClose, onUpgrade }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 absolute top-[50vh]">
                <h2 className="text-lg font-semibold text-gray-800">
                    Upgrade to Premium
                </h2>
                <p className="text-gray-600 mt-2">
                    You’re just 1 click away from more puzzles!
                </p>

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                    >
                        Close
                    </button>
                    <button
                        onClick={onUpgrade}
                        className="flex items-center px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                        <FaCrown className="w-4 h-4 mr-2" />
                        Upgrade Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModalHome;
