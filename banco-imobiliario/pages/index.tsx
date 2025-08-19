import { useState } from 'react';
import { useRouter } from 'next/router';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';
import { Spinner } from '../components/icons/Spinner';

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  const handleCreateGame = async () => {
    setIsCreating(true);
    const newRoomCode = generateRoomCode();
    try {
      const gameDocRef = await addDoc(collection(db, 'games'), {
        roomCode: newRoomCode,
        createdAt: serverTimestamp(),
        players: [],
        status: 'waiting',
        initialBalance: 1500,
        bankBalance: 100000000, // <-- NOVO: Saldo inicial do banco
      });
      localStorage.setItem(`banco_imobiliario_host_${gameDocRef.id}`, 'true');
      toast.success(`Jogo ${newRoomCode} criado!`);
      router.push(`/game/${gameDocRef.id}`);
    } catch (error) {
      console.error("Erro ao criar o jogo:", error);
      toast.error("Não foi possível criar o jogo.");
      setIsCreating(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsJoining(true);
    
    try {
      const q = query(collection(db, 'games'), where('roomCode', '==', roomCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('Código da sala não encontrado.');
        setIsJoining(false);
        return;
      }
      
      const gameDoc = querySnapshot.docs[0];
      router.push(`/game/${gameDoc.id}`);

    } catch (error) {
      console.error("Erro ao entrar no jogo:", error);
      toast.error("Ocorreu um erro ao tentar entrar na sala.");
      setIsJoining(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-400">Banco Imobiliário</h1>
          <p className="text-gray-400 mt-2">Gerencie suas partidas de forma digital.</p>
        </div>

        <button
          onClick={handleCreateGame}
          disabled={isCreating}
          className="w-full flex justify-center items-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isCreating ? <Spinner /> : 'Criar Novo Jogo'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">OU</span>
          </div>
        </div>

        <form onSubmit={handleJoinGame} className="space-y-4">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Digite o código da sala"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            maxLength={5}
          />
          <button
            type="submit"
            disabled={isJoining || !roomCode}
            className="w-full flex justify-center items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isJoining ? <Spinner /> : 'Entrar em um Jogo'}
          </button>
        </form>
      </div>
    </div>
  );
}