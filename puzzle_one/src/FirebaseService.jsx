// FirebaseService.js
import { db, storage } from './firebase';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

class FirebaseService {
  static async createPiece(roomId, pieceData) {
    try {
      const piecesRef = collection(db, `rooms/${roomId}/pieces`);
      const docRef = doc(piecesRef, pieceData.id);
      await setDoc(docRef, {
        ...pieceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating piece:', error);
      throw error;
    }
  }

  static async updatePiecePosition(roomId, pieceId, position, rotation) {
    try {
      const pieceRef = doc(db, `rooms/${roomId}/pieces`, pieceId);

      const pieceDoc = await getDoc(pieceRef);

      if (!pieceDoc.exists()) {
        await setDoc(pieceRef, {
          id: pieceId,
          position,
          rotation,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        await updateDoc(pieceRef, {
          position,
          rotation,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating piece position:', error);
      throw error;
    }
  }
  static async createRoom(roomData) {
    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        ...roomData,
        createdAt: new Date(),
        status: 'active'
      });
      return roomRef.id;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  static async joinRoom(roomId, playerData) {
    try {
      const playerRef = await addDoc(collection(db, `rooms/${roomId}/players`), {
        ...playerData,
        joinedAt: new Date(),
        status: 'active'
      });
      return playerRef.id;
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  static subscribeToRoom(roomId, callback) {
    return onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      callback({ id: doc.id, ...doc.data() });
    });
  }

  static subscribeToPieces(roomId, callback) {
    const piecesQuery = query(
      collection(db, `rooms/${roomId}/pieces`),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(piecesQuery, (snapshot) => {
      const pieces = [];
      snapshot.forEach((doc) => {
        pieces.push({ id: doc.id, ...doc.data() });
      });
      callback(pieces);
    });
  }

  static async updatePiecePosition(roomId, pieceId, position, rotation) {
    try {
      const pieceRef = doc(db, `rooms/${roomId}/pieces`, pieceId);
      await updateDoc(pieceRef, {
        position,
        rotation,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating piece position:', error);
      throw error;
    }
  }

  static async uploadImage(file, roomId) {
    try {
      const imageRef = ref(storage, `puzzles/${roomId}/${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      return url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  static async updateGameState(roomId, gameState) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        gameState,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating game state:', error);
      throw error;
    }
  }

  static subscribeToPlayers(roomId, callback) {
    const playersQuery = query(
      collection(db, `rooms/${roomId}/players`),
      where('status', '==', 'active')
    );

    return onSnapshot(playersQuery, (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
      });
      callback(players);
    });
  }

  static async leaveRoom(roomId, playerId) {
    try {
      const playerRef = doc(db, `rooms/${roomId}/players`, playerId);
      await updateDoc(playerRef, {
        status: 'inactive',
        leftAt: new Date()
      });
    } catch (error) {
      console.error('Error leaving room:', error);
      throw error;
    }
  }

  static async saveAchievement(roomId, playerId, achievement) {
    try {
      await addDoc(collection(db, `rooms/${roomId}/achievements`), {
        playerId,
        ...achievement,
        unlockedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving achievement:', error);
      throw error;
    }
  }

  static subscribeToAchievements(roomId, callback) {
    const achievementsQuery = query(
      collection(db, `rooms/${roomId}/achievements`),
      orderBy('unlockedAt', 'desc')
    );

    return onSnapshot(achievementsQuery, (snapshot) => {
      const achievements = [];
      snapshot.forEach((doc) => {
        achievements.push({ id: doc.id, ...doc.data() });
      });
      callback(achievements);
    });
  }

  static async cleanupRoom(roomId) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        status: 'completed',
        completedAt: new Date()
      });
    } catch (error) {
      console.error('Error cleaning up room:', error);
      throw error;
    }
  }
  async updatePlayerAchievements(roomId, playerId, achievements) {
    try {
      const playerRef = doc(this.db, `rooms/${roomId}/players`, playerId);
      await updateDoc(playerRef, {
        achievements,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating player achievements:', error);
      throw error;
    }
  }

  async updateHighScore(roomId, playerId, score) {
    try {
      const playerRef = doc(this.db, `rooms/${roomId}/players`, playerId);
      await updateDoc(playerRef, {
        highScore: score,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating high score:', error);
      throw error;
    }
  }
}


export default FirebaseService;