import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/icons/Spinner';

// Tipagem para os dados
interface Player {
  id: string;
  name: string;
  balance: number;
}

interface Game {
  roomCode: string;
  players: Player[];
  initialBalance: number;
  bankBalance: number;
  status: 'waiting' | 'playing' | 'finished';
}

export default function GamePage() {
  const router = useRouter();
  const { id: gameId } = router.query;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [bankTransferPlayer, setBankTransferPlayer] = useState('');
  const [bankTransferAmount, setBankTransferAmount] = useState('');

  useEffect(() => {
    if (!gameId) return;
    const hostCheck = localStorage.getItem(`banco_imobiliario_host_${gameId}`);
    setIsHost(!!hostCheck);
    const localPlayer = localStorage.getItem(`banco_imobiliario_player_${gameId}`);
    if(localPlayer) setCurrentPlayer(JSON.parse(localPlayer));

    const unsub = onSnapshot(doc(db, 'games', gameId as string), (doc) => {
      if (doc.exists()) {
        const gameData = doc.data() as Game;
        setGame(gameData);
        if(localPlayer) {
            const parsedPlayer = JSON.parse(localPlayer);
            const updatedPlayer = gameData.players.find(p => p.id === parsedPlayer.id);
            if(updatedPlayer) {
                setCurrentPlayer(updatedPlayer);
                localStorage.setItem(`banco_imobiliario_player_${gameId}`, JSON.stringify(updatedPlayer));
            } else {
                localStorage.removeItem(`banco_imobiliario_player_${gameId}`);
                setCurrentPlayer(null);
            }
        }
      } else {
        toast.error("Jogo não encontrado!");
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [gameId, router]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName || !gameId) return;
    const newPlayer: Player = {
      id: newPlayerName.toLowerCase().replace(/\s+/g, '-'),
      name: newPlayerName,
      balance: game?.status === 'playing' ? game.initialBalance : 0,
    };
    if (game?.players.some(p => p.id === newPlayer.id)) {
        toast.error("Já existe um jogador com esse nome.");
        return;
    }
    try {
      await updateDoc(doc(db, 'games', gameId as string), { players: arrayUnion(newPlayer) });
      toast.success(`${newPlayerName} adicionado!`);
      setNewPlayerName('');
    } catch (error) { toast.error("Erro ao adicionar jogador."); }
  };

  const handleSelectPlayer = (player: Player) => {
      setCurrentPlayer(player);
      localStorage.setItem(`banco_imobiliario_player_${gameId}`, JSON.stringify(player));
  }

  const handleStartGame = async () => {
    if (!game || !gameId) return;
    const playersWithBalance = game.players.map(p => ({ ...p, balance: game.initialBalance }));
    try {
        await updateDoc(doc(db, 'games', gameId as string), { players: playersWithBalance, status: 'playing' });
        toast.success("O jogo começou! Saldo inicial distribuído.");
    } catch (error) { toast.error("Erro ao iniciar o jogo."); }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || !gameId || !currentPlayer || !transferTo || !transferAmount) return;
    const amount = parseInt(transferAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido."); return; }
    if (currentPlayer.balance < amount) { toast.error("Saldo insuficiente."); return; }

    let newBankBalance = game.bankBalance;
    const updatedPlayers = game.players.map(p => {
        if (p.id === currentPlayer.id) return { ...p, balance: p.balance - amount };
        if (p.id === transferTo) return { ...p, balance: p.balance + amount };
        return p;
    });

    if (transferTo === 'banco') {
        newBankBalance += amount;
    }
    
    try {
        await updateDoc(doc(db, 'games', gameId as string), { players: updatedPlayers, bankBalance: newBankBalance });
        toast.success(`$${amount.toLocaleString()} transferido para ${transferTo}!`);
        setTransferTo('');
        setTransferAmount('');
    } catch (error) { toast.error("Erro na transferência."); }
  }

  const handleBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || !gameId || !bankTransferPlayer || !bankTransferAmount) return;
    const amount = parseInt(bankTransferAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido."); return; }
    if (game.bankBalance < amount) { toast.error("Saldo do banco insuficiente."); return; }

    const updatedPlayers = game.players.map(p => {
        if (p.id === bankTransferPlayer) return { ...p, balance: p.balance + amount };
        return p;
    });
    const newBankBalance = game.bankBalance - amount;

    try {
        await updateDoc(doc(db, 'games', gameId as string), { players: updatedPlayers, bankBalance: newBankBalance });
        toast.success(`$${amount.toLocaleString()} enviado para ${bankTransferPlayer}!`);
        setBankTransferPlayer('');
        setBankTransferAmount('');
    } catch (error) { toast.error("Erro ao enviar dinheiro do banco."); }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><Spinner /> Carregando Jogo...</div>;
  if (!game) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Jogo não encontrado.</div>;

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-6 p-4 bg-gray-800 rounded-lg">
          <h1 className="text-2xl font-bold text-cyan-400">Sala: <span className="text-white">{game.roomCode}</span></h1>
          <button onClick={() => { navigator.clipboard.writeText(game.roomCode); toast.success('Código copiado!'); }} className="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">Copiar</button>
        </header>

        {isHost && (
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Painel do Banqueiro</h2>
                {game.status === 'waiting' && (
                    <>
                        <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
                            <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Nome do novo jogador" className="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"/>
                            <button type="submit" className="px-4 py-2 bg-cyan-600 rounded-lg font-bold hover:bg-cyan-700">Adicionar</button>
                        </form>
                        {game.players.length > 1 && <button onClick={handleStartGame} className="w-full py-3 bg-green-600 rounded-lg font-bold hover:bg-green-700">Iniciar Jogo e Distribuir Saldo</button>}
                    </>
                )}
                {game.status === 'playing' && (
                    <form onSubmit={handleBankTransfer} className="space-y-3">
                        <h3 className="font-semibold">Enviar Dinheiro do Banco</h3>
                         <select value={bankTransferPlayer} onChange={e => setBankTransferPlayer(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600">
                            <option value="">Para o jogador...</option>
                            {game.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" value={bankTransferAmount} onChange={e => setBankTransferAmount(e.target.value)} placeholder="Valor" className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600"/>
                        <button type="submit" className="w-full p-3 bg-cyan-600 rounded-lg font-bold hover:bg-cyan-700">Confirmar Envio</button>
                    </form>
                )}
            </div>
        )}

        {!currentPlayer && game.status !== 'waiting' && (
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
                <h2 className="text-xl font-semibold mb-4">Quem é você?</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {game.players.map(p => <button key={p.id} onClick={() => handleSelectPlayer(p)} className="p-4 bg-gray-700 rounded-lg hover:bg-cyan-600">{p.name}</button>)}
                </div>
            </div>
        )}

        {currentPlayer && (
             <div className="bg-cyan-800 p-6 rounded-lg mb-6 sticky top-4 z-10 shadow-lg">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-lg font-bold">{currentPlayer.name} (Você)</p>
                        <p className="text-4xl font-mono tracking-wider">${currentPlayer.balance.toLocaleString()}</p>
                    </div>
                    <button onClick={() => { setCurrentPlayer(null); localStorage.removeItem(`banco_imobiliario_player_${gameId}`); }} className="text-sm text-cyan-200 hover:underline">Trocar Jogador</button>
                </div>
                <form onSubmit={handleTransfer} className="mt-4 space-y-3">
                    <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 appearance-none">
                        <option value="">Transferir para...</option>
                        <option value="banco">Banco</option>
                        {game.players.filter(p => p.id !== currentPlayer.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Valor" className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600"/>
                    <button type="submit" className="w-full p-3 bg-gray-900 rounded-lg font-bold hover:bg-black transition-colors">Enviar Dinheiro</button>
                </form>
             </div>
        )}

        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Saldos na Sala</h2>
            {/* Saldo do Banco */}
            <div className="flex justify-between items-center p-4 bg-yellow-900/50 border border-yellow-500/50 rounded-lg">
                <span className="font-bold text-lg text-yellow-300">🏦 Banco</span>
                {/* CORREÇÃO APLICADA AQUI */}
                <span className="font-mono text-lg text-yellow-300">${typeof game.bankBalance === 'number' ? game.bankBalance.toLocaleString() : '...'}</span>
            </div>
            {/* Saldo dos Jogadores */}
            {game.players.map(player => (
                <div key={player.id} className={`flex justify-between items-center p-4 rounded-lg ${player.id === currentPlayer?.id ? 'bg-gray-700' : 'bg-gray-800'}`}>
                    <span className="font-bold text-lg">{player.name}</span>
                    <span className="font-mono text-lg text-green-400">${player.balance.toLocaleString()}</span>
                </div>
            ))}
             {game.players.length === 0 && <p className="text-gray-400 text-center mt-4">Aguardando jogadores...</p>}
        </div>
      </div>
    </div>
  );
}
