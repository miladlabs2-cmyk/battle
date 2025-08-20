export default function Battle_tick({ data }) {
    return (
        <div className="p-4 bg-yellow-500">
            <h2 className="text-2xl font-semibold mb-2">battle_tick</h2>
            <pre className="text-xs md:text-sm whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}


