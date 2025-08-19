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
        bankBalance: 100000000,
      });
      localStorage.setItem(`banco_imobiliario_host_${gameDocRef.id}`, 'true');
      toast.success(`Sala ${newRoomCode} criada!`);
      router.push(`/game/${gameDocRef.id}`);
    } catch (error) {
      console.error("Erro ao criar o jogo:", error);
      toast.error("Falha ao criar sala. Tente novamente.");
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
        toast.error('Código da sala inválido.');
        setIsJoining(false);
        return;
      }
      
      const gameDoc = querySnapshot.docs[0];
      router.push(`/game/${gameDoc.id}`);

    } catch (error) {
      console.error("Erro ao entrar no jogo:", error);
      toast.error("Ocorreu um erro ao conectar à sala.");
      setIsJoining(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-900/50 border border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/10 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-cyan-400 tracking-widest">B.I.</h1>
          <p className="text-slate-400 mt-2">Banco Imobiliário Digital</p>
        </div>

        <button
          onClick={handleCreateGame}
          disabled={isCreating}
          className="w-full flex justify-center items-center px-6 py-3 bg-cyan-500/80 hover:bg-cyan-400 text-slate-900 font-bold rounded-md transition-all duration-300 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 disabled:bg-slate-700 disabled:cursor-not-allowed"
        >
          {isCreating ? <Spinner /> : 'NOVA SALA'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900 text-slate-500">OU</span>
          </div>
        </div>

        <form onSubmit={handleJoinGame} className="space-y-4">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO DA SALA"
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-md text-white placeholder-slate-500 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            maxLength={5}
          />
          <button
            type="submit"
            disabled={isJoining || !roomCode}
            className="w-full flex justify-center items-center px-6 py-3 bg-fuchsia-600/80 hover:bg-fuchsia-500 text-slate-900 font-bold rounded-md transition-all duration-300 shadow-lg shadow-fuchsia-600/20 hover:shadow-fuchsia-500/40 disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {isJoining ? <Spinner /> : 'CONECTAR'}
          </button>
        </form>
      </div>
    </div>
  );
}