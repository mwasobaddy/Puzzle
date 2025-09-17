
# Puzzle App

An interactive, collaborative puzzle web application built with React and Vite. This app features multiplayer puzzle solving, custom puzzle creation, user authentication, leaderboards, payment integration, and more. It is designed for both fun and educational purposes, with a focus on cultural and user-generated puzzles.

## Features

- Real-time collaborative puzzle solving
- Custom puzzle and image uploads
- User authentication and subscription management
- Leaderboards and progress tracking
- Payment integration (Stripe, PayPal)
- Difficulty selection and tracking
- Responsive, modern UI with Tailwind CSS
- Firebase backend integration

## Tech Stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stripe](https://stripe.com/) & [PayPal](https://paypal.com/) (payments)
- [Babylon.js](https://www.babylonjs.com/) (3D rendering)

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm (v9+ recommended)

### Installation

1. Clone the repository:
	```sh
	git clone <your-repo-url>
	cd puzzle/puzzle_one
	```
2. Install dependencies:
	```sh
	npm install
	```
3. Set up Firebase:
	- Configure your Firebase project and update `src/firebaseConfig.js` with your credentials.
	- (Optional) Update `firebase.json` for hosting and functions as needed.
4. Start the development server:
	```sh
	npm run dev
	```
	The app will be available at [http://localhost:5173](http://localhost:5173) (or another port if 5173 is in use).

### Available Scripts

- `npm run dev` — Start the Vite development server
- `npm run build` — Build the app for production
- `npm run preview` — Preview the production build
- `npm run lint` — Run ESLint

## Project Structure

```
puzzle_one/
├── public/                # Static assets
├── src/
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── constants/         # App constants
│   ├── shaders/           # 3D/visual shaders
│   ├── types/             # Type definitions
│   ├── firebase.js        # Firebase initialization
│   ├── firebaseConfig.js  # Firebase config
│   └── main.jsx           # App entry point
├── functions/             # Backend serverless functions
├── package.json           # Project metadata & scripts
├── tailwind.config.js     # Tailwind CSS config
├── vite.config.js         # Vite config
└── ...
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for new features, bug fixes, or improvements.

## License

This project is licensed under the MIT License.

---

_Built with ❤️ using React, Vite, and Firebase._
