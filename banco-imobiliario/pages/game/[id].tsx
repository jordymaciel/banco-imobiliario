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
        toast.error("Este nome de jogador já existe.");
        return;
    }
    try {
      await updateDoc(doc(db, 'games', gameId as string), { players: arrayUnion(newPlayer) });
      toast.success(`${newPlayerName} entrou na sala.`);
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
        toast.success("Jogo iniciado! Saldo distribuído.");
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
        const targetName = transferTo === 'banco' ? 'Banco' : game.players.find(p => p.id === transferTo)?.name;
        toast.success(`$${amount.toLocaleString()} transferido para ${targetName}!`);
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
        const targetName = game.players.find(p => p.id === bankTransferPlayer)?.name;
        toast.success(`$${amount.toLocaleString()} enviado para ${targetName}!`);
        setBankTransferPlayer('');
        setBankTransferAmount('');
    } catch (error) { toast.error("Erro ao enviar dinheiro do banco."); }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-purple-400"><Spinner /> Carregando dados...</div>;
  if (!game) return <div className="flex items-center justify-center min-h-screen text-red-500">Erro: Sala não encontrada.</div>;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-white">
            Sala <span className="text-purple-400">{game.roomCode}</span>
          </h1>
          <button onClick={() => { navigator.clipboard.writeText(game.roomCode); toast.success('Código copiado!'); }} className="px-4 py-2 bg-black/20 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">Copiar</button>
        </header>

        {isHost && (
            <div className="bg-black/20 border border-white/10 p-6 rounded-2xl mb-8 backdrop-blur-lg">
                <h2 className="text-lg font-bold mb-4 text-purple-400">Painel do Banqueiro</h2>
                {game.status === 'waiting' && (
                    <>
                        <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
                            <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Nome do jogador" className="flex-grow px-4 py-2 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                            <button type="submit" className="px-5 py-2 bg-purple-600 rounded-xl font-bold hover:bg-purple-500">Add</button>
                        </form>
                        {game.players.length > 1 && <button onClick={handleStartGame} className="w-full py-3 bg-green-600/80 rounded-xl font-bold hover:bg-green-500">Iniciar Jogo</button>}
                    </>
                )}
                {game.status === 'playing' && (
                    <form onSubmit={handleBankTransfer} className="space-y-3">
                        <h3 className="font-bold">Enviar Dinheiro do Banco</h3>
                         <select value={bankTransferPlayer} onChange={e => setBankTransferPlayer(e.target.value)} className="w-full p-3 bg-black/20 border border-white/10 rounded-xl appearance-none">
                            <option value="">Selecione o jogador...</option>
                            {game.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" value={bankTransferAmount} onChange={e => setBankTransferAmount(e.target.value)} placeholder="Valor" className="w-full p-3 bg-black/20 border border-white/10 rounded-xl"/>
                        <button type="submit" className="w-full p-3 bg-purple-600 rounded-xl font-bold hover:bg-purple-500">Confirmar Envio</button>
                    </form>
                )}
            </div>
        )}

        {!currentPlayer && game.status !== 'waiting' && (
            <div className="bg-black/20 border border-white/10 p-6 rounded-2xl mb-8 backdrop-blur-lg">
                <h2 className="text-xl font-bold mb-4 text-purple-400">Quem é você?</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {game.players.map(p => <button key={p.id} onClick={() => handleSelectPlayer(p)} className="p-4 bg-black/20 border border-white/10 rounded-xl hover:bg-purple-500 transition-colors">{p.name}</button>)}
                </div>
            </div>
        )}

        {currentPlayer && (
             <div className="bg-gradient-to-br from-zinc-900/50 to-zinc-900/20 border border-white/10 p-6 rounded-2xl mb-8 sticky top-4 z-10 shadow-2xl backdrop-blur-lg">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-zinc-400">Meu Saldo</p>
                        <p className="text-4xl font-black tracking-tighter">${currentPlayer.balance.toLocaleString()}</p>
                    </div>
                    <button onClick={() => { setCurrentPlayer(null); localStorage.removeItem(`banco_imobiliario_player_${gameId}`); }} className="text-xs text-zinc-400 hover:underline">Sair</button>
                </div>
                <form onSubmit={handleTransfer} className="mt-6 pt-6 border-t border-white/10 space-y-3">
                    <h3 className="font-bold text-purple-400">Nova Transferência</h3>
                    <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full p-3 bg-black/20 border border-white/10 rounded-xl appearance-none">
                        <option value="">Transferir para...</option>
                        <option value="banco">Banco</option>
                        {game.players.filter(p => p.id !== currentPlayer.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Valor" className="w-full p-3 bg-black/20 border border-white/10 rounded-xl"/>
                    <button type="submit" className="w-full p-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-colors">Enviar</button>
                </form>
             </div>
        )}

        <div className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-300">Saldos na Sala</h2>
            <div className="flex justify-between items-center p-4 bg-black/20 border border-white/10 rounded-xl">
                <span className="font-bold">🏦 Banco</span>
                <span className="font-semibold">${typeof game.bankBalance === 'number' ? game.bankBalance.toLocaleString() : '...'}</span>
            </div>
            {game.players.map(player => (
                <div key={player.id} className={`flex justify-between items-center p-4 rounded-xl transition-colors bg-black/20 border ${player.id === currentPlayer?.id ? 'border-purple-500/50' : 'border-white/10'}`}>
                    <span className="font-bold">{player.name} {player.id === currentPlayer?.id ? '(Você)' : ''}</span>
                    <span className="font-semibold text-zinc-300">${player.balance.toLocaleString()}</span>
                </div>
            ))}
             {game.players.length === 0 && <p className="text-zinc-500 text-center mt-4">Aguardando jogadores...</p>}
        </div>
      </div>
    </div>
  );
}